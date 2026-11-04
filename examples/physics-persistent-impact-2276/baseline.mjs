import {createPhysicsWorld} from '../../packages/barocss-physics/dist/index.js';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const id=process.argv[2];if(!/^[a-z0-9-]+$/.test(id??''))throw Error('fresh evidence ID required');
const out=resolve('examples/physics-persistent-impact-2276/evidence',id);mkdirSync(out,{recursive:false});
const model=makeModel({revision:'g2-persistent-impact-baseline',gravityMps2:[0,0,0],parts:[
 staticPart('floor',{kind:'box',halfExtentsM:[2,.5,2]},{positionM:[0,-.5,0]},{restitution:.25}),
 dynamicPart('moving',{kind:'box',halfExtentsM:[.5,.5,.5]},{positionM:[0,.5,0],velocityMps:[0,-2,0]},2,{restitution:.8})]});
const options={profile:'rigid-persistent-box-v1',fixedStepSeconds:1/120,broadPhase:'direct'};
const pins={};for(const path of ['packages/barocss-physics/src/world.ts','packages/barocss-physics/src/persistent-box-contact.ts','packages/barocss-physics/src/provider-manifest.generated.ts','packages/barocss-physics/dist/index.js']){const b=readFileSync(path);pins[path]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
cpSync('packages/barocss-physics/dist',resolve(out,'provider-dist'),{recursive:true});
for(const path of ['world.ts','persistent-box-contact.ts'])cpSync('packages/barocss-physics/src/'+path,resolve(out,path));
const w=createPhysicsWorld(model,options);let before,after;try{before=w.getState();after=w.step();}finally{w.dispose();}
const b=after.bodies.find(b=>b.id==='moving'),expected={velocityMps:[0,.5,0],normalImpulseNs:5,energyJ:.25};
const velocityError=Math.abs(b.velocityMps[1]-.5),result={status:velocityError<=1e-10?'UNEXPECTED_BASELINE_PASS':'PHYSICAL_NO_GO_RESTITUTION_IGNORED',counts:{worlds:1,acceptedSteps:1},model,options,pins,before,after,expected,velocityError};
writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,actualVelocity:b.velocityMps,velocityError,contacts:after.contacts.length}));if(result.status!=='PHYSICAL_NO_GO_RESTITUTION_IGNORED')process.exitCode=1;
